#ifndef CHATLISTITEM_H
#define CHATLISTITEM_H

#include <QWidget>
#include <QLabel>
#include <QHBoxLayout>
#include <QVBoxLayout>

class ChatListItem : public QWidget
{
    Q_OBJECT
public:
    explicit ChatListItem(const QString &name, const QString &lastMessage, const QString &time, const QString &avatarUrl = "", QWidget *parent = nullptr);

private:
    QLabel *avatarLabel;
    QLabel *nameLabel;
    QLabel *lastMessageLabel;
    QLabel *timeLabel;
    QLabel *unreadBadge;
};

#endif // CHATLISTITEM_H
