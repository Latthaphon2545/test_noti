import express from 'express'
import axios from 'axios'
import { GoogleAuth } from 'google-auth-library'

const app = express()
const port = 3000

app.get('/', async (req, res) => {
    try {
        const fcmToken = req.header('fcmToken')
        const privateKeyRaw = req.header('FIREBASE_PRIVATE')
        const clientEmail = req.header('FIREBASE_CLIENT_EMAIL')
        const projectId = req.header('FIREBASE_PROJECT_ID')

        if (!fcmToken) {
            return res.status(400).json({ error: 'Missing fcmToken header' })
        }
        if (!privateKeyRaw || !clientEmail) {
            return res.status(400).json({ error: 'Missing Firebase credentials' })
        }

        // 🔥 Fix private key ให้เป็น multiline
        const privateKey = privateKeyRaw.replace(/\\n/g, '\n')

        // ---------------------------
        // STEP 1: Get Access Token
        // ---------------------------
        let accessToken
        try {
            const auth = new GoogleAuth({
                credentials: {
                    private_key: privateKey,
                    client_email: clientEmail
                },
                scopes: ['https://www.googleapis.com/auth/firebase.messaging']
            })

            const client = await auth.getClient()
            const tokenRes = await client.getAccessToken()
            // เช็ค role ของ service account ว่ามีสิทธิ์ส่ง FCM หรือไม่

            accessToken = tokenRes.token
        } catch (err: any) {
            console.error("❌ Error generating access token:", err.message)
            return res.status(500).json({ error: "Failed to generate Google Access Token" })
        }

        // ---------------------------
        // STEP 2: Build Message
        // ---------------------------
        const dateTime = new Date()
        const timeString = dateTime.toTimeString().split(' ')[0]
        dateTime.setHours(dateTime.getHours() + 7) // GMT+7
        const dateString = dateTime.toLocaleDateString('en-GB').split('/').join('-')
        const body = {
            message: {
                token: fcmToken,
                // topic: 'onboarding',
                notification: {
                    title: 'Transaction Notification',
                    body: 'You have a successful transaction. fcm'
                },
                data: {
                    TYPE: req.header('type') || "NONE",
                    SUBTYPE: req.header('subType') || "NONE",
                    REFERENCE: 'test',
                    WALLET_ID: "1234567890",
                    AMOUNT: "123",
                    DATE: dateString,
                    TIME: timeString
                },
                android: { priority: 'high' },
                // apns: {
                //     headers: {
                //         "apns-priority": "5"
                //     },
                //     payload: {
                //         aps: {
                //             "content-available": 1
                //         }
                //     }
                // }
            }
        }

        // ---------------------------
        // STEP 3: Send FCM v1
        // ---------------------------
        try {
            const result = await axios.post(
                `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
                body,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            )

            return res.json({ success: true, firebaseResponse: result.data })

        } catch (err: any) {
            console.error("❌ FCM Send Error:", err.response?.data || err.message)
            return res.status(500).json({
                error: "Failed to send FCM",
                details: err.response?.data || err.message
            })
        }

    } catch (e: any) {
        console.error("Unexpected Error:", e)
        return res.status(500).json({ error: "Internal server error" })
    }
})

// app.get('/subscribe', (req, res) => {
//     res.send('Subscribe endpoint is under construction.')
// })

// app.get('/test/subscribe', (req, res) => {
//     res.send('Test Subscribe endpoint is under construction.')
// })

app.listen(port, () => {
    console.log(`🚀 Server running: http://localhost:${port}`)
})
