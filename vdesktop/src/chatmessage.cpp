#include "chatmessage.h"

ChatMessage::ChatMessage(const QString &content, bool isSender, QWidget *parent)
    : QWidget(parent)
{
    QHBoxLayout *mainLayout = new QHBoxLayout(this);
    mainLayout->setContentsMargins(10, 2, 10, 2);

    bubble = new QWidget(this);
    QVBoxLayout *bubbleLayout = new QVBoxLayout(bubble);
    bubbleLayout->setContentsMargins(12, 8, 12, 8);

    contentLabel = new QLabel(content, bubble);
    contentLabel->setWordWrap(true);
    contentLabel->setStyleSheet("color: white; font-size: 15px; border: none; background: transparent;");
    
    bubbleLayout->addWidget(contentLabel);

    if (isSender) {
        bubble->setStyleSheet("background-color: #c67c78; border-radius: 15px; border-bottom-right-radius: 2px;");
        mainLayout->addStretch();
        mainLayout->addWidget(bubble);
    } else {
        bubble->setStyleSheet("background-color: #212d3b; border-radius: 15px; border-bottom-left-radius: 2px;");
        mainLayout->addWidget(bubble);
        mainLayout->addStretch();
    }
    
    bubble->setMaximumWidth(400);
}
