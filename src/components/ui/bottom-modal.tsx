import { ViewStyle, View, StyleSheet } from "react-native";
import { Modal, Text, Button, Portal, useTheme } from "react-native-paper";

interface BottomAppModalProps {
  children: React.ReactNode;
  title: string;
  hide: () => void;
  show: boolean;
  submit?: () => void;
  submitDisabled?: boolean;
  submitLabel?: string;
}

export function BottomAppModal({
  children,
  title,
  hide,
  show,
  submit,
  submitDisabled,
  submitLabel = "Save",
}: BottomAppModalProps) {
  const theme = useTheme();
  return (
    <Portal>
      <Modal
        visible={show}
        onDismiss={hide}
        contentContainerStyle={[
          styles.container,
          { backgroundColor: theme.colors.elevation.level4 },
        ]}
      >
        <View>
          <Text style={styles.title}>{title}</Text>
          {children}
          <View style={styles.action}>
            <View style={styles.buttonGroup}>
              {submit && (
                <Button
                  mode="contained"
                  onPress={submit}
                  disabled={submitDisabled}
                  style={styles.button}
                >
                  {submitLabel}
                </Button>
              )}
              <Button onPress={hide} style={styles.button}>
                Close
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  title: {
    fontSize:20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  action: {
    marginTop: 16,
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  button: {
    margin: 4,
  },
});