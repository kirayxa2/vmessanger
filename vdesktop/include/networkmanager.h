#ifndef NETWORKMANAGER_H
#define NETWORKMANAGER_H

#include <QObject>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>

class NetworkManager : public QObject
{
    Q_OBJECT
public:
    explicit NetworkManager(QObject *parent = nullptr);
    
    void login(const QString &username, const QString &password);
    void fetchConversations();
    void sendMessage(const QString &conversationId, const QString &content);

signals:
    void loginSuccess(const QJsonObject &user);
    void loginError(const QString &error);
    void conversationsFetched(const QJsonArray &conversations);
    void newMessageReceived(const QJsonObject &message);

private:
    QNetworkAccessManager *networkManager;
    QString baseUrl = "http://localhost:3000";
    QString authToken;
};

#endif // NETWORKMANAGER_H
