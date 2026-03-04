#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QWidget>
#include <QListWidget>
#include <QStackedWidget>
#include <QLineEdit>
#include <QPushButton>

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private:
    void setupUi();
    void applyStyles();

    QWidget *centralWidget;
    QHBoxLayout *mainLayout;
    
    // Sidebar
    QWidget *sidebar;
    QVBoxLayout *sidebarLayout;
    QLineEdit *searchField;
    QListWidget *chatList;
    
    // Chat Area
    QWidget *chatArea;
    QVBoxLayout *chatAreaLayout;
    QStackedWidget *chatStack;
    QWidget *emptyChatPlaceholder;
};

#endif // MAINWINDOW_H
