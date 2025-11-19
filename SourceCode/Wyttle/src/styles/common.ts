import { StyleSheet } from 'react-native';

export const commonStyles = StyleSheet.create({
  // Generic screen padding used across auth and main screens
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
  },

  // Text input used in auth forms and other simple forms
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 22,
    backgroundColor: '#ececec',
  },

  // Base primary button style – screens can extend/override this
  primaryButton: {
    paddingVertical: 22,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#333f5c',
    
  },

  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
});
