#include "chatlistitem.h"

ChatListItem::ChatListItem(const QString &name, const QString &lastMessage, const QString &time, const QString &avatarUrl, QWidget *parent)
    : QWidget(parent)
{
    QHBoxLayout *layout = new QHBoxLayout(this);
    layout->setContentsMargins(10, 8, 10, 8);
    layout->setSpacing(12);

    avatarLabel = new QLabel(this);
    avatarLabel->setFixedSize(54, 54);
    avatarLabel->setStyleSheet("background-color: #8b72f3; border-radius: 27px; color: white; font-weight: bold; font-size: 20px; border: none;");
    avatarLabel->setAlignment(Qt::AlignCenter);
    avatarLabel->setText(name.at(0).toUpper());
    
    layout->addWidget(avatarLabel);

    QVBoxLayout *textLayout = new QVBoxLayout();
    textLayout->setSpacing(2);

    QHBoxLayout *topRow = new QHBoxLayout();
    nameLabel = new QLabel(name, this);
    nameLabel->setStyleSheet("color: white; font-weight: 600; font-size: 16px; border: none; background: transparent;");
    
    timeLabel = new QLabel(time, this);
    timeLabel->setStyleSheet("color: rgba(255, 255, 255, 0.5); font-size: 13px; border: none; background: transparent;");
    
    topRow->addWidget(nameLabel);
    topRow->addStretch();
    topRow->addWidget(timeLabel);
    
    textLayout->addLayout(topRow);

    lastMessageLabel = new QLabel(lastMessage, this);
    lastMessageLabel->setStyleSheet("color: rgba(255, 255, 255, 0.7); font-size: 15px; border: none; background: transparent;");
    lastMessageLabel->setWordWrap(false);
    
    textLayout->addWidget(lastMessageLabel);
    
    layout->addLayout(textLayout);
}
