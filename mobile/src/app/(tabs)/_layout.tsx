import { Stack } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bgPrimary },
        animation: "fade",
      }}
    />
  );
}
