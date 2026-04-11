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

    // Track running activities by our custom ID
    private var activityMap: [String: String] = [:]  // customId -> Activity.id

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
                        "activityId": id
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

        Task {
            for activity in Activity<GenericAttributes>.activities {
                if activity.id == activityMap[id] {
                    let content = ActivityContent(state: state, staleDate: nil)
                    await activity.update(content)
                    call.resolve()
                    return
                }
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

        Task {
            for activity in Activity<GenericAttributes>.activities {
                if activity.id == activityMap[id] {
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
            call.resolve() // Already ended or not found — not an error
        }
    }
}
