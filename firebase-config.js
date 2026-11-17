window.FY_FIREBASE = {
  projectId: 'foyin-lingqi-app',
  apiKey: 'AIzaSyDsU4vkNL9K34cWkobGQ8L4qDkdPtzTJcw',
  authDomain: 'foyin-lingqi-app.firebaseapp.com',
  appId: '1:958708359043:web:dac69e63a7572ad67ea0b6'
};

(function () {
  if (!window.firebase) { return; }
  try {
    firebase.initializeApp(window.FY_FIREBASE);
    window.FY_AUTH = firebase.auth();
    window.FY_DB = firebase.firestore();
  } catch (e) {
    if (window.console) { console.warn('[Firebase] init failed', e); }
  }
})();
