#ifndef CHATMESSAGE_H
#define CHATMESSAGE_H

#include <QWidget>
#include <QString>
#include <QPainter>
#include <QDateTime>

class ChatMessage : public QWidget
{
    Q_OBJECT
public:
    explicit ChatMessage(const QString &content, const QString &time, bool isSender, bool hasTail, QWidget *parent = nullptr);

protected:
    void paintEvent(QPaintEvent *event) override;
    void resizeEvent(QResizeEvent *event) override;
    QSize sizeHint() const override;

private:
    QString m_content;
    QString m_time;
    bool m_isSender;
    bool m_hasTail;
    
    int m_maxBubbleWidth;
    QRect m_bubbleRect;
    QRect m_textRect;
};

#endif // CHATMESSAGE_H
