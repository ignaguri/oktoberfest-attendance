import CoreLocation
import Foundation

enum LocationError: Error {
    case denied
    case failed(Error)
}

/// Wraps CLLocationManager in an async-friendly API.
final class LocationService: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation, Error>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
    }

    /// Returns the current device location.
    /// Requests `.authorizedWhenInUse` if status is `.notDetermined`.
    /// Throws `LocationError.denied` if the user has not granted permission.
    func currentLocation() async throws -> CLLocation {
        let status = manager.authorizationStatus
        if status == .denied || status == .restricted {
            throw LocationError.denied
        }
        return try await withCheckedThrowingContinuation { cont in
            self.continuation = cont
            if status == .notDetermined {
                manager.requestWhenInUseAuthorization()
                // Authorization delegate will trigger location request after grant.
            } else {
                manager.requestLocation()
            }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            // Permission just granted — now request a single location fix.
            manager.requestLocation()
        case .denied, .restricted:
            continuation?.resume(throwing: LocationError.denied)
            continuation = nil
        default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        continuation?.resume(returning: location)
        continuation = nil
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        continuation?.resume(throwing: LocationError.failed(error))
        continuation = nil
    }
}
