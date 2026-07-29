# Chapter 18: Sensor-aware applications

*Week 18 · 2+1 hrs*

What makes a mobile app different from a website in the browser: direct access to device hardware.

| Sensor | Typical use |
| --- | --- |
| GPS / location | Maps, "near me" features, geofencing |
| Accelerometer / gyroscope | Step counting, screen orientation, games |
| Camera | QR scanning, photo capture, augmented reality |
| Push notifications | Waking the app with a server-sent alert |

## Push notifications, tying back to Chapter 1

This is the exact same mechanism that woke up Sarah's ex's phone in Chapter 1's case study: your server tells a push service (Apple's APNs or Google's FCM) to deliver an alert, the OS wakes the app, the app then makes its own API call to fetch the details.

![Diagram: your server pushing a notification](/notes/img/web/ch18-push-notifications.svg)

> Sensors are accessed through the platform's own APIs (Swift/Kotlin) or a cross-platform library's wrapper around them. The pattern is always the same: ask permission, read the sensor, react to the value.
