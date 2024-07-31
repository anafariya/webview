// import 'dart:io';

// import 'package:flutter/material.dart';
// import 'package:flutter/services.dart';
// import 'package:webview_flutter/webview_flutter.dart';
// import 'package:permission_handler/permission_handler.dart';

// class CameraWebView extends StatefulWidget {
//   @override
//   _CameraWebViewState createState() => _CameraWebViewState();
// }

// class _CameraWebViewState extends State<CameraWebView> {
//   late WebViewController _controller;
//   bool _permissionGranted = false;

//   @override
//   void initState() {
//     super.initState();
//         // if (Platform.isAndroid) WebView.platform = SurfaceAndroidWebView();

//     _initializeWebView();      _loadWebViewContent();
//     // Enable hybrid composition.
//   //   if (Platform.isAndroid)
//   //   WebViewPlatform == SurfaceAndroidViewController;
//   // WebViewWidget.fromPlatform(platform: SurfaceAndroidViewController().viewId)

//   //    WebView.platform = SurfaceAndroidWebView();
  

//     // _requestCameraPermission();
//   }

//   void _initializeWebView() {
//     _controller = WebViewController()
//       ..setJavaScriptMode(JavaScriptMode.unrestricted)
//       ..setBackgroundColor(const Color(0x00000000))
//       ..setNavigationDelegate(
//         NavigationDelegate(
//           onProgress: (int progress) {
//             // Update loading bar.
//           },
//           onPageStarted: (String url) {},
//           onPageFinished: (String url) {},
//           onWebResourceError: (WebResourceError error) {
//             print('WebView error: ${error.description}');
//           },
//           onNavigationRequest: (NavigationRequest request) {
//             return NavigationDecision.navigate;
//           },
//         ),
//       );
//   }

//   Future<void> _requestCameraPermission() async {
//     final status = await Permission.camera.request();
//     setState(() {
//       _permissionGranted = status.isGranted;
//     });
//     if (_permissionGranted) {
//       _initializeWebView();
//       _loadWebViewContent();
//     } else {
//       _showPermissionDeniedDialog();
//     }
//   }

//   void _loadWebViewContent() {
//     _controller.loadFlutterAsset('assets/web/index.html');
//   }

//   Future<void> _showPermissionDeniedDialog() async {
//     return showDialog<void>(
//       context: context,
//       barrierDismissible: false, // User must tap button!
//       builder: (BuildContext context) {
//         return AlertDialog(
//           title: Text('Camera Permission Required'),
//           content: SingleChildScrollView(
//             child: ListBody(
//               children: <Widget>[
//                 Text('This app needs access to your camera to function properly.'),
//                 Text('Please grant camera permission in your device settings.'),
//               ],
//             ),
//           ),
//           actions: <Widget>[
//             TextButton(
//               child: Text('Cancel'),
//               onPressed: () {
//                 Navigator.of(context).pop();
//               },
//             ),
//             TextButton(
//               child: Text('Open Settings'),
//               onPressed: () {
//                 Navigator.of(context).pop();
//                 openAppSettings();
//               },
//             ),
//           ],
//         );
//       },
//     );
//   }

//   @override
//   Widget build(BuildContext context) {
//     return Scaffold(
//       appBar: AppBar(title: Text('Camera WebView')),
//       body: _permissionGranted
//           ? WebViewWidget(controller: _controller)
//           : Center(
//               child: Column(
//                 mainAxisAlignment: MainAxisAlignment.center,
//                 children: [
//                   Text('Camera permission is required.'),
//                   ElevatedButton(
//                     onPressed: _requestCameraPermission,
//                     child: Text('Grant Permission'),
//                   ),
//                 ],
//               ),
//             ),
//     );
//   }
// }