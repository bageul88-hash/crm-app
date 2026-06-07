import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyCw1zaKFIT6wnOpXV1QHbuALfK3EHO3Rnc',
  authDomain: 'pentwo-call.firebaseapp.com',
  databaseURL: 'https://pentwo-call-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'pentwo-call',
  storageBucket: 'pentwo-call.firebasestorage.app',
  messagingSenderId: '840065097190',
  appId: '1:840065097190:web:412c49c24293d907678a27',
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
