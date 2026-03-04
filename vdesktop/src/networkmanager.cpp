#include "networkmanager.h"
#include <QNetworkRequest>
#include <QHttpMultiPart>
#include <QUrlQuery>

NetworkManager::NetworkManager(QObject *parent)
    : QObject(parent)
{
    networkManager = new QNetworkAccessManager(this);
}

void NetworkManager::login(const QString &email, const QString &password)
{
    QUrl url(baseUrl + "/api/auth/callback/credentials");
    QNetworkRequest request(url);
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/x-www-form-urlencoded");

    // NextAuth credentials login usually requires CSRF token and other fields.
    // This is a simplified version.
    QUrlQuery params;
    params.addQueryItem("email", email);
    params.addQueryItem("password", password);
    params.addQueryItem("redirect", "false");
    params.addQueryItem("json", "true");

    QNetworkReply *reply = networkManager->post(request, params.toString(QUrl::FullyEncoded).toUtf8());
    
    connect(reply, &QNetworkReply::finished, [this, reply]() {
        if (reply->error() == QNetworkReply::NoError) {
            QJsonDocument doc = QJsonDocument::fromJson(reply->readAll());
            emit loginSuccess(doc.object());
        } else {
            emit loginError(reply->errorString());
        }
        reply->deleteLater();
    });
}

void NetworkManager::fetchConversations()
{
    QUrl url(baseUrl + "/api/conversations");
    QNetworkRequest request(url);
    // request.setRawHeader("Cookie", ...); // Need to handle session cookies

    QNetworkReply *reply = networkManager->get(request);
    
    connect(reply, &QNetworkReply::finished, [this, reply]() {
        if (reply->error() == QNetworkReply::NoError) {
            QJsonDocument doc = QJsonDocument::fromJson(reply->readAll());
            emit conversationsFetched(doc.array());
        }
        reply->deleteLater();
    });
}

void NetworkManager::sendMessage(const QString &conversationId, const QString &content)
{
    QUrl url(baseUrl + "/api/messages");
    QNetworkRequest request(url);
    request.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");

    QJsonObject body;
    body["conversationId"] = conversationId;
    body["content"] = content;

    QNetworkReply *reply = networkManager->post(request, QJsonDocument(body).toJson());
    
    connect(reply, &QNetworkReply::finished, [reply]() {
        reply->deleteLater();
    });
}
