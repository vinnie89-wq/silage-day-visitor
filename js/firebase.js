/* =========================================================
   One shared connection to Firebase for the whole page
   ---------------------------------------------------------
   News, Photos and Tickets all use this, so Firebase is only
   loaded and started once per page (starting it twice causes
   an error). It loads only when something actually needs it.

   It also keeps a copy of what it has read on the phone, so
   things show quickly next time and work better with poor
   signal – and costs fewer database "reads".

     getFirebase()   → { app, auth, db, A, F }
                       A = sign-in tools, F = database tools
     signInVisitor() → makes sure this phone is signed in
                       (anonymously – no details needed)
   ========================================================= */

const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
let firebasePromise = null;

function firebaseConfigured() {
  return typeof FIREBASE_CONFIG !== "undefined" && !!FIREBASE_CONFIG.apiKey && !!FIREBASE_CONFIG.projectId;
}

function getFirebase() {
  if (!firebaseConfigured()) return Promise.reject(new Error("Firebase isn't set up yet"));
  if (!firebasePromise) {
    firebasePromise = Promise.all([
      import(FIREBASE_SDK + "firebase-app.js"),
      import(FIREBASE_SDK + "firebase-auth.js"),
      import(FIREBASE_SDK + "firebase-firestore.js")
    ]).then(function (mods) {
      const appMod = mods[0], A = mods[1], F = mods[2];
      const app = appMod.initializeApp(FIREBASE_CONFIG);
      let db;
      try {
        // Keep a copy on the phone, shared safely between open tabs
        db = F.initializeFirestore(app, {
          localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() })
        });
      } catch (e) {
        db = F.getFirestore(app); // older browsers: no saved copy, works the same online
      }
      return { app: app, auth: A.getAuth(app), db: db, A: A, F: F };
    });
    firebasePromise.catch(function () { firebasePromise = null; }); // try again next time if it failed
  }
  return firebasePromise;
}

// Visitors are signed in "anonymously": no account or details, it just
// lets the security rules tell this phone apart from others.
async function signInVisitor() {
  const fb = await getFirebase();
  if (fb.auth.authStateReady) await fb.auth.authStateReady();
  if (!fb.auth.currentUser) await fb.A.signInAnonymously(fb.auth);
  return fb;
}
