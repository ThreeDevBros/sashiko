import ActivityKit
import Foundation

/// Shared ActivityAttributes used by both the main App and the Widget Extension.
/// Add this file to BOTH targets in Xcode (App + OrderTrackingWidgetExtension).
struct GenericAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var values: [String: String]
    }
}
