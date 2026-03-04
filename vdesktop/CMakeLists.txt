cmake_minimum_required(VERSION 3.16)

project(vdesktop VERSION 0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 REQUIRED COMPONENTS Widgets Network Gui WebSockets)

add_executable(vdesktop
    src/main.cpp
    src/mainwindow.cpp
    src/chatlistitem.cpp
    src/networkmanager.cpp
    src/chatmessage.cpp
    include/mainwindow.h
    include/chatlistitem.h
    include/networkmanager.h
    include/chatmessage.h
    resources.qrc
)

target_include_directories(vdesktop PRIVATE include)

target_link_libraries(vdesktop PRIVATE Qt6::Widgets Qt6::Network Qt6::Gui Qt6::WebSockets)

if(WIN32)
    set_target_properties(vdesktop PROPERTIES WIN32_EXECUTABLE TRUE)
endif()
