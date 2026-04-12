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

    // MARK: - Persistent activity mapping (UserDefaults-backed)
    private static let mapKey = "com.liveactivity.activityMap"

    private var activityMap: [String: String] {
        get {
            UserDefaults.standard.dictionary(forKey: Self.mapKey) as? [String: String] ?? [:]
        }
        set {
            UserDefaults.standard.set(newValue, forKey: Self.mapKey)
        }
    }

    /// Rebuild the map from any still-running activities (survives app kill)
    private func rebuildMapFromRunningActivities() {
        guard #available(iOS 16.2, *) else { return }
        var map = activityMap
        for activity in Activity<GenericAttributes>.activities {
            // If this activity isn't in our map, we can't recover the custom ID,
            // but at least we won't lose activities that ARE in the map.
            // Clean up entries whose native activity no longer exists.
        }
        // Remove map entries that point to activities no longer running
        let runningIds = Set(Activity<GenericAttributes>.activities.map { $0.id })
        for (customId, nativeId) in map {
            if !runningIds.contains(nativeId) {
                map.removeValue(forKey: customId)
            }
        }
        activityMap = map
    }

    /// End all stale activities that don't match the given order ID
    private func cleanupStaleActivities(exceptOrderId: String) {
        guard #available(iOS 16.2, *) else { return }
        let map = activityMap
        for activity in Activity<GenericAttributes>.activities {
            // Check if this activity belongs to a different order
            let isCurrentOrder = map.contains(where: { $0.key == exceptOrderId && $0.value == activity.id })
            if !isCurrentOrder {
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

        // Rebuild map from running activities in case app was killed
        rebuildMapFromRunningActivities()

        // Clean up stale activities from previous orders
        cleanupStaleActivities(exceptOrderId: id)

        let attributes = GenericAttributes()
        let state = GenericAttributes.ContentState(values: contentStateDict)

        do {
            let content = ActivityContent(state: state, staleDate: nil)
            let activity = try Activity.request(
                attributes: attributes,
                content: content,
                pushType: .token
            )

            activityMap[id] = activity.id

            // Observe push token
            Task {
                for await tokenData in activity.pushTokenUpdates {
                    let token = tokenData.map { String(format: "%02x", $0) }.joined()
                    self.notifyListeners("liveActivityPushToken", data: [
                        "token": token,
                        "activityId": activity.id,
                        "customId": id,
                        "orderId": id
                    ])
                }
            }

            call.resolve(["activityId": activity.id])
        } catch {
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

        Task {
            for activity in Activity<GenericAttributes>.activities {
                if activity.id == nativeId {
                    let content = ActivityContent(state: state, staleDate: nil)
                    await activity.update(content)
                    call.resolve()
                    return
                }
            }
            // Fallback: try to find any running activity and update it
            // (handles case where map was cleared but activity still runs)
            if let firstActivity = Activity<GenericAttributes>.activities.first {
                let content = ActivityContent(state: state, staleDate: nil)
                await firstActivity.update(content)
                // Re-map it
                activityMap[id] = firstActivity.id
                call.resolve()
                return
            }
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
                    call.resolve()
                    return
                }
            }
            // Clean up map entry even if activity wasn't found
            activityMap.removeValue(forKey: id)
            call.resolve() // Already ended or not found — not an error
        }
    }
}
