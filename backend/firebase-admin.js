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
        // Inicialización por defecto con Project ID
        admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || "cuycitogo"
        });
        console.log("🔥 [Firebase Admin] Inicializado con Project ID predeterminado (cuycitogo)");
    }
    db = admin.firestore();
} catch (error) {
    console.warn("⚠️ [Firebase Admin] Aviso al inicializar Firebase Admin:", error.message);
    if (admin.apps.length > 0) {
        db = admin.firestore();
    }
}

export { admin, db };
