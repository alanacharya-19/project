import { useTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IconName, inactive: IconName) {
  return ({ color, focused, size }: { color: ColorValue | null; focused: boolean; size: number }) => (
    <Ionicons
      name={focused ? active : inactive}
      size={size - 2}
      color={typeof color === 'string' ? color : undefined}
    />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.background },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: 1,
        },
        tabBarItemStyle: {
          paddingTop: 6,
          paddingBottom: 6,
        },
        tabBarStyle: {
          position: 'absolute',
          marginLeft:40,
          marginRight:40,
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, 10) + (Platform.OS === 'ios' ? 2 : 8),
          height: 66,
          borderRadius: 50,
          backgroundColor: colors.tabBar,
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: colors.borderSoft,
          paddingTop: 4,
          paddingBottom: 4,
          elevation: 14,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0,
          shadowRadius: 22,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: tabIcon('home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: tabIcon('calendar', 'calendar-outline'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: tabIcon('settings', 'settings-outline'),
        }}
      />
    </Tabs>
  );
}
