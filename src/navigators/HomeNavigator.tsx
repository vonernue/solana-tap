import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { TopBar } from "../components/top-bar/top-bar-feature";
import { HomeScreen } from "../screens/HomeScreen";
import MaterialCommunityIcon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "react-native-paper";
import BlankScreen from "../screens/BlankScreen";

const Tab = createBottomTabNavigator();

/**
 * This is the main navigator with a bottom tab bar.
 * Each tab is a stack navigator with its own set of screens.
 *
 * More info: https://reactnavigation.org/docs/bottom-tab-navigator/
 */
export function HomeNavigator() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => <TopBar />,
        tabBarIcon: ({ focused, color, size }) => {
          switch (route.name) {
            case "Send":
              return (
                <MaterialCommunityIcon
                  name={focused ? "send" : "send-outline"}
                  size={size}
                  color={color}
                />
              );
            case "Receive":
              return (
                <MaterialCommunityIcon
                  name={
                    focused ? "inbox-arrow-down" : "inbox-arrow-down-outline"
                  }
                  size={size}
                  color={color}
                />
              );
          }
        },
      })}
    >
      <Tab.Screen name="Send" component={HomeScreen} />
      <Tab.Screen name="Receive" component={BlankScreen} />
    </Tab.Navigator>
  );
}
