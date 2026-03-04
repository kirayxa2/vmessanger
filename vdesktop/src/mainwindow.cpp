#include "mainwindow.h"
#include "chatlistitem.h"
#include "chatmessage.h"
#include <QLabel>
#include <QFrame>
#include <QListWidgetItem>
#include <QScrollArea>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
{
    setupUi();
    applyStyles();
    setWindowTitle("Vortex Messenger");
    resize(1000, 700);
}

MainWindow::~MainWindow()
{
}

void MainWindow::setupUi()
{
    centralWidget = new QWidget(this);
    mainLayout = new QHBoxLayout(centralWidget);
    mainLayout->setContentsMargins(0, 0, 0, 0);
    mainLayout->setSpacing(0);

    // Sidebar
    sidebar = new QWidget(centralWidget);
    sidebar->setFixedWidth(400);
    sidebarLayout = new QVBoxLayout(sidebar);
    sidebarLayout->setContentsMargins(0, 0, 0, 0);
    sidebarLayout->setSpacing(0);

    // Search bar container
    QWidget *searchContainer = new QWidget(sidebar);
    QHBoxLayout *searchLayout = new QHBoxLayout(searchContainer);
    searchLayout->setContentsMargins(10, 10, 10, 10);
    
    searchField = new QLineEdit(searchContainer);
    searchField->setPlaceholderText("Search");
    searchLayout->addWidget(searchField);
    
    sidebarLayout->addWidget(searchContainer);

    chatList = new QListWidget(sidebar);
    sidebarLayout->addWidget(chatList);

    // Add some dummy items
    for (int i = 0; i < 5; ++i) {
        QListWidgetItem *item = new QListWidgetItem(chatList);
        ChatListItem *widget = new ChatListItem("User " + QString::number(i+1), "Last message from user " + QString::number(i+1), "12:34", "", chatList);
        item->setSizeHint(widget->sizeHint());
        chatList->addItem(item);
        chatList->setItemWidget(item, widget);
    }

    mainLayout->addWidget(sidebar);

    // Chat Area
    chatArea = new QWidget(centralWidget);
    chatAreaLayout = new QVBoxLayout(chatArea);
    chatAreaLayout->setContentsMargins(0, 0, 0, 0);
    chatAreaLayout->setSpacing(0);

    chatStack = new QStackedWidget(chatArea);
    
    emptyChatPlaceholder = new QWidget();
    QVBoxLayout *emptyLayout = new QVBoxLayout(emptyChatPlaceholder);
    emptyChatPlaceholder->setObjectName("emptyChatPlaceholder");
    
    QLabel *emptyLabel = new QLabel("Select a chat to start messaging", emptyChatPlaceholder);
    emptyLabel->setAlignment(Qt::AlignCenter);
    emptyLayout->addWidget(emptyLabel);
    
    chatStack->addWidget(emptyChatPlaceholder);

    // Chat view mockup
    QWidget *chatView = new QWidget();
    QVBoxLayout *chatViewLayout = new QVBoxLayout(chatView);
    chatViewLayout->setContentsMargins(0, 0, 0, 0);
    chatViewLayout->setSpacing(0);

    // Header
    QWidget *header = new QWidget();
    header->setFixedHeight(63);
    header->setObjectName("chatHeader");
    QHBoxLayout *headerLayout = new QHBoxLayout(header);
    headerLayout->setContentsMargins(15, 0, 15, 0);
    
    QVBoxLayout *headerTextLayout = new QVBoxLayout();
    headerTextLayout->setSpacing(0);
    
    QLabel *chatTitle = new QLabel("Vortex", header);
    chatTitle->setStyleSheet("color: white; font-weight: bold; font-size: 16px; border: none; background: transparent;");
    
    QLabel *statusLabel = new QLabel("last seen recently", header);
    statusLabel->setStyleSheet("color: rgba(255, 255, 255, 0.5); font-size: 13px; border: none; background: transparent;");
    
    headerTextLayout->addWidget(chatTitle);
    headerTextLayout->addWidget(statusLabel);
    
    headerLayout->addLayout(headerTextLayout);
    headerLayout->addStretch();

    // Icons on the right
    QPushButton *searchBtn = new QPushButton(header);
    searchBtn->setFixedSize(40, 40);
    searchBtn->setStyleSheet("QPushButton { border: none; background: transparent; color: #7d8b99; } QPushButton:hover { background: rgba(255,255,255,0.05); border-radius: 20px; }");
    // icon placeholder
    headerLayout->addWidget(searchBtn);
    
    QPushButton *moreBtn = new QPushButton(header);
    moreBtn->setFixedSize(40, 40);
    moreBtn->setStyleSheet("QPushButton { border: none; background: transparent; color: #7d8b99; } QPushButton:hover { background: rgba(255,255,255,0.05); border-radius: 20px; }");
    // icon placeholder
    headerLayout->addWidget(moreBtn);
    
    chatViewLayout->addWidget(header);

    // Messages area
    QScrollArea *scrollArea = new QScrollArea();
    scrollArea->setWidgetResizable(true);
    scrollArea->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    scrollArea->setStyleSheet("border: none;");
    
    QWidget *messagesContainer = new QWidget();
    messagesContainer->setObjectName("messagesArea");
    QVBoxLayout *messagesLayout = new QVBoxLayout(messagesContainer);
    messagesLayout->addStretch(); // Push messages to bottom
    
    // Add some dummy messages
    messagesLayout->addWidget(new ChatMessage("Hello!", false));
    messagesLayout->addWidget(new ChatMessage("Hi there! How are you?", true));
    messagesLayout->addWidget(new ChatMessage("I am doing great, thanks for asking!", false));
    messagesLayout->addWidget(new ChatMessage("Did you see the new Qt6!!! features?", true));
    
    scrollArea->setWidget(messagesContainer);
    chatViewLayout->addWidget(scrollArea, 1);

    // Input area
    QWidget *inputContainer = new QWidget();
    inputContainer->setObjectName("inputContainer");
    QHBoxLayout *inputLayout = new QHBoxLayout(inputContainer);
    inputLayout->setContentsMargins(10, 10, 10, 15);
    inputLayout->setSpacing(10);

    QPushButton *attachBtn = new QPushButton(inputContainer);
    attachBtn->setFixedSize(45, 45);
    attachBtn->setStyleSheet("QPushButton { border: none; background: transparent; color: #7d8b99; } QPushButton:hover { background: rgba(255,255,255,0.05); border-radius: 22px; }");
    inputLayout->addWidget(attachBtn);

    QLineEdit *messageInput = new QLineEdit();
    messageInput->setPlaceholderText("Message");
    messageInput->setObjectName("messageInput");
    inputLayout->addWidget(messageInput);

    QPushButton *micBtn = new QPushButton(inputContainer);
    micBtn->setFixedSize(50, 50);
    micBtn->setStyleSheet("QPushButton { border: none; background-color: #7e85e1; border-radius: 25px; color: white; } QPushButton:hover { background-color: #8b92f3; }");
    inputLayout->addWidget(micBtn);

    chatViewLayout->addWidget(inputContainer);
    
    chatStack->addWidget(chatView);
    chatStack->setCurrentIndex(1); // Show mockup for now

    chatAreaLayout->addWidget(chatStack);

    mainLayout->addWidget(chatArea);

    setCentralWidget(centralWidget);
}

void MainWindow::applyStyles()
{
    // These colors are taken from app/globals.css
    QString qss = R"(
        QMainWindow {
            background-color: #0e1621;
        }
        QWidget#centralWidget {
            background-color: #0e1621;
        }
        QWidget#sidebar {
            background-color: #1c242f;
            border-right: 1px solid #000000;
        }
        QWidget#searchContainer {
            background-color: #1c242f;
        }
        QLineEdit {
            background-color: #242f3d;
            border: none;
            border-radius: 8px;
            padding: 10px 12px;
            color: white;
            font-size: 15px;
        }
        QListWidget {
            background-color: #1c242f;
            border: none;
            outline: none;
        }
        QListWidget::item {
            padding: 10px;
            border-radius: 10px;
            margin: 2px 8px;
            color: white;
        }
        QListWidget::item:hover {
            background-color: rgba(255, 255, 255, 0.05);
        }
        QListWidget::item:selected {
            background-color: #8b72f3;
            color: white;
        }
        QLabel {
            color: #555555;
            font-size: 14px;
        }
        QWidget#chatHeader {
            background-color: #1c242f;
            border-bottom: 1px solid #000000;
        }
        QWidget#messagesArea {
            background-image: url(":/resources/pattern.svg");
            background-color: #0e1621;
        }
        QLineEdit#messageInput {
            background-color: #242f3d;
            border-radius: 12px;
            padding: 12px 16px;
            min-height: 45px;
            color: white;
            font-size: 16px;
        }
        QWidget#inputContainer {
            background-color: #1c242f;
            border-top: 1px solid #000000;
        }
        QWidget#emptyChatPlaceholder {
            background-color: #0e1621;
        }
    )";
    
    this->setStyleSheet(qss);
    sidebar->setObjectName("sidebar");
    centralWidget->setObjectName("centralWidget");
}
