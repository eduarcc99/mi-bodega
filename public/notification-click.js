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
