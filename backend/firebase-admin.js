import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

let db = null;

try {
    const resolvedPath = path.resolve(config.serviceAccountPath);
    if (fs.existsSync(resolvedPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("🔥 [Firebase Admin] Inicializado con Service Account Key:", resolvedPath);
    } else {
        admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || "cuycitogo-app"
        });
        console.log("🔥 [Firebase Admin] Inicializado con Project ID (cuycitogo-app)");
    }
    db = admin.firestore();
} catch (error) {
    if (admin.apps.length > 0) {
        db = admin.firestore();
    } else {
        console.warn("⚠️ [Firebase Admin]:", error.message);
    }
}

export { admin, db };
