package com.sohaibrahman64.syncfoundmobilefrontend

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class ChatFirebaseMessagingService : FirebaseMessagingService() {

  override fun onNewToken(token: String) {
    super.onNewToken(token)
    // JS layer listens to onTokenRefresh and re-registers token with backend.
  }

  override fun onMessageReceived(message: RemoteMessage) {
    super.onMessageReceived(message)

    val data = message.data
    val type = data["type"]?.trim().orEmpty()
    val conversationId = data["conversation_id"]?.trim().orEmpty()
    if (conversationId.isBlank()) {
      return
    }

    ensureChatNotificationChannel()

    val messageId = data["message_id"]?.trim().orEmpty()
    val previewText = data["preview_text"]?.trim().orEmpty()

    val deepLinkUri = android.net.Uri.parse(
      "syncfound://chat?chat_conversation_id=${android.net.Uri.encode(conversationId)}" +
        if (messageId.isNotBlank()) "&chat_message_id=${android.net.Uri.encode(messageId)}" else ""
    )

    val openIntent = Intent(Intent.ACTION_VIEW, deepLinkUri, this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }

    val requestCode = conversationId.hashCode()
    val pendingIntent = PendingIntent.getActivity(
      this,
      requestCode,
      openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val title = if (type == "chat.message.read") "Message read" else "New message"
    val body = if (previewText.isNotBlank()) {
      previewText
    } else if (type == "chat.message.read") {
      "Your message was read."
    } else {
      "You have a new chat update."
    }

    val notification = NotificationCompat.Builder(this, CHAT_CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setContentIntent(pendingIntent)
      .build()

    NotificationManagerCompat.from(this).notify(requestCode, notification)
  }

  private fun ensureChatNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val existingChannel = notificationManager.getNotificationChannel(CHAT_CHANNEL_ID)
    if (existingChannel != null) {
      return
    }

    val channel = NotificationChannel(
      CHAT_CHANNEL_ID,
      CHAT_CHANNEL_NAME,
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Notifications for chat activity"
    }

    notificationManager.createNotificationChannel(channel)
  }

  companion object {
    private const val CHAT_CHANNEL_ID = "chat_messages"
    private const val CHAT_CHANNEL_NAME = "Chat Messages"
  }
}
