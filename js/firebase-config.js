/* =========================================================
   Firebase settings – the online database for visitor photos
   ---------------------------------------------------------
   Until this is filled in, the Photos page says photo sharing
   "isn't switched on yet" and everything else works as normal.

   HOW TO FILL IT IN (see README.md, "Photos – setting up Firebase"):
   Firebase console → ⚙ Project settings → Your apps → the web
   app (</>) → "SDK setup and configuration" → Config.
   Copy the values from there into the matching lines below.

   These values are NOT secret – every website that uses Firebase
   shows them to its visitors. What keeps the photos safe is the
   security rules in firebase/firestore.rules.
   ========================================================= */

const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
