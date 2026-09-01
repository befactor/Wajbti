import Foundation
import Capacitor
import HealthKit

@objc(StepsPlugin)
public class StepsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StepsPlugin"
    public let jsName = "Steps"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getTodaySteps", returnType: CAPPluginReturnPromise)
    ]

    private let healthStore = HKHealthStore()

    @objc func getTodaySteps(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit not available on this device")
            return
        }
        guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            call.reject("Step count type unavailable")
            return
        }

        healthStore.requestAuthorization(toShare: [], read: [stepType]) { [weak self] success, error in
            guard let self = self else { return }
            guard success else {
                call.reject("HealthKit authorization denied", nil, error)
                return
            }

            let calendar = Calendar.current
            let startOfDay = calendar.startOfDay(for: Date())
            let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: Date(), options: .strictStartDate)
            let query = HKStatisticsQuery(quantityType: stepType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, statistics, error in
                if let error = error {
                    call.reject("Failed to read step count", nil, error)
                    return
                }
                let steps = statistics?.sumQuantity()?.doubleValue(for: .count()) ?? 0
                call.resolve(["steps": steps])
            }
            self.healthStore.execute(query)
        }
    }
}
