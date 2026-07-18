self.addEventListener('push', function (event) {
  var data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = {}
  }

  var title = data.title || '🛒 Nuevo pedido web'
  var options = {
    body: data.body || 'Hay un pedido web pendiente',
    icon: '/favicon_.svg',
    badge: '/favicon_.svg',
    tag: data.tag || 'pedido-web',
    vibrate: [400, 120, 400, 120, 400, 120, 600],
    requireInteraction: true,
    renotify: true,
    data: { url: data.url || '/pedidos-web', pedidoId: data.pedidoId },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var url = (event.notification.data && event.notification.data.url) || '/pedidos-web'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i]
        if ('focus' in client) {
          return client.focus().then(function () {
            if ('navigate' in client) return client.navigate(url)
          })
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
