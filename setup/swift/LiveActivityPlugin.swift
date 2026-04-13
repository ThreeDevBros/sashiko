import Capacitor
import ActivityKit

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startActivityWithPush", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endActivity", returnType: CAPPluginReturnPromise),
    ]

    private static let mapKey = "com.liveactivity.activityMap"
    private var observedActivityIds = Set<String>()

    private var activityMap: [String: String] {
        get {
            UserDefaults.standard.dictionary(forKey: Self.mapKey) as? [String: String] ?? [:]
        }
        set {
            UserDefaults.standard.set(newValue, forKey: Self.mapKey)
        }
    }

    private func rebuildMapFromRunningActivities() {
        guard #available(iOS 16.2, *) else { return }

        var map = activityMap
        let runningIds = Set(Activity<GenericAttributes>.activities.map { $0.id })
        let beforeCount = map.count

        for (customId, nativeId) in map {
            if !runningIds.contains(nativeId) {
                map.removeValue(forKey: customId)
            }
        }

        activityMap = map
        print("[LiveActivity] rebuildMapFromRunningActivities running=\(runningIds.count) mapBefore=\(beforeCount) mapAfter=\(map.count)")
    }

    @available(iOS 16.2, *)
    private func existingActivity(forOrderId orderId: String) -> Activity<GenericAttributes>? {
        guard let nativeId = activityMap[orderId] else { return nil }
        return Activity<GenericAttributes>.activities.first(where: { $0.id == nativeId })
    }

    @available(iOS 16.2, *)
    private func observePushTokenUpdates(for activity: Activity<GenericAttributes>, customId: String) {
        guard !observedActivityIds.contains(activity.id) else { return }
        observedActivityIds.insert(activity.id)

        print("[LiveActivity] Observing push token updates for activity \(activity.id) order \(customId)")

        Task {
            for await tokenData in activity.pushTokenUpdates {
                let token = tokenData.map { String(format: "%02x", $0) }.joined()
                DispatchQueue.main.async {
                    self.notifyListeners("liveActivityPushToken", data: [
                        "token": token,
                        "activityId": activity.id,
                        "customId": customId,
                        "orderId": customId
                    ])
                }
            }
        }
    }

    private func cleanupStaleActivities(exceptOrderId: String) {
        guard #available(iOS 16.2, *) else { return }
        let map = activityMap

        for activity in Activity<GenericAttributes>.activities {
            let isCurrentOrder = map.contains(where: { $0.key == exceptOrderId && $0.value == activity.id })
            if !isCurrentOrder {
                print("[LiveActivity] Ending stale activity \(activity.id) while starting order \(exceptOrderId)")
                Task {
                    let content = ActivityContent(state: activity.content.state, staleDate: nil)
                    await activity.end(content, dismissalPolicy: .immediate)
                }
            }
        }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["value": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["value": false])
        }
    }

    @objc func startActivityWithPush(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+")
            return
        }

        guard let id = call.getString("id"),
              let contentStateDict = call.getObject("contentState") as? [String: String] else {
            call.reject("Missing 'id' or 'contentState'")
            return
        }

        rebuildMapFromRunningActivities()
        print("[LiveActivity] startActivityWithPush requested for order \(id) running=\(Activity<GenericAttributes>.activities.count)")

        let attributes = GenericAttributes()
        let state = GenericAttributes.ContentState(values: contentStateDict)

        if let existing = existingActivity(forOrderId: id) {
            print("[LiveActivity] Reusing existing activity \(existing.id) for order \(id)")
            let content = ActivityContent(state: state, staleDate: nil)
            Task {
                await existing.update(content)
            }
            activityMap[id] = existing.id
            observePushTokenUpdates(for: existing, customId: id)
            call.resolve(["activityId": existing.id, "reused": true])
            return
        }

        cleanupStaleActivities(exceptOrderId: id)

        do {
            let content = ActivityContent(state: state, staleDate: nil)
            let activity = try Activity.request(
                attributes: attributes,
                content: content,
                pushType: .token
            )

            activityMap[id] = activity.id
            print("[LiveActivity] Created new activity \(activity.id) for order \(id)")
            observePushTokenUpdates(for: activity, customId: id)
            call.resolve(["activityId": activity.id])
        } catch {
            print("[LiveActivity] Failed to start activity for order \(id): \(error.localizedDescription)")
            call.reject("Failed to start Live Activity: \(error.localizedDescription)")
        }
    }

    @objc func updateActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+")
            return
        }

        guard let id = call.getString("id"),
              let contentStateDict = call.getObject("contentState") as? [String: String] else {
            call.reject("Missing 'id' or 'contentState'")
            return
        }

        let state = GenericAttributes.ContentState(values: contentStateDict)
        let nativeId = activityMap[id]
        print("[LiveActivity] updateActivity requested for order \(id) nativeId=\(nativeId ?? "nil")")

        Task {
            for activity in Activity<GenericAttributes>.activities {
                if activity.id == nativeId {
                    let content = ActivityContent(state: state, staleDate: nil)
                    await activity.update(content)
                    call.resolve()
                    return
                }
            }

            if let firstActivity = Activity<GenericAttributes>.activities.first {
                print("[LiveActivity] updateActivity fallback remapping order \(id) to activity \(firstActivity.id)")
                let content = ActivityContent(state: state, staleDate: nil)
                await firstActivity.update(content)
                activityMap[id] = firstActivity.id
                observePushTokenUpdates(for: firstActivity, customId: id)
                call.resolve()
                return
            }

            print("[LiveActivity] updateActivity failed — activity not found for order \(id)")
            call.reject("Activity not found for id: \(id)")
        }
    }

    @objc func endActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2+")
            return
        }

        guard let id = call.getString("id") else {
            call.reject("Missing 'id'")
            return
        }

        let contentStateDict = call.getObject("contentState") as? [String: String]
        let nativeId = activityMap[id]
        print("[LiveActivity] endActivity requested for order \(id) nativeId=\(nativeId ?? "nil")")

        Task {
            for activity in Activity<GenericAttributes>.activities {
                if activity.id == nativeId {
                    let finalState: GenericAttributes.ContentState
                    if let dict = contentStateDict {
                        finalState = GenericAttributes.ContentState(values: dict)
                    } else {
                        finalState = activity.content.state
                    }
                    let content = ActivityContent(state: finalState, staleDate: nil)
                    await activity.end(content, dismissalPolicy: .after(.now + 300))
                    activityMap.removeValue(forKey: id)
                    observedActivityIds.remove(activity.id)
                    call.resolve()
                    return
                }
            }

            activityMap.removeValue(forKey: id)
            call.resolve()
        }
    }
}
