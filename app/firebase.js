import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// 기존 도담캐시 파이어베이스 접속 정보
const firebaseConfig = {
    apiKey: "AIzaSyAkGwzW3ZgYI6RnP0wryRgxS_YDNwtEI50",
    authDomain: "abc-desk.firebaseapp.com",
    projectId: "abc-desk",
    storageBucket: "abc-desk.firebasestorage.app",
    messagingSenderId: "941875786407",
    appId: "1:941875786407:web:0f9fbeb3663396f694e182"
};

// 파이어베이스 초기화 및 내보내기
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };