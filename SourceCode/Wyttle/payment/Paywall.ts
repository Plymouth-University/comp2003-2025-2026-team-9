import RevenueCatUI, { CustomVariableValue, PAYWALL_RESULT } from 'react-native-purchases-ui';

export async function presentPaywall(tokensBalance: number | null): Promise<PAYWALL_RESULT> {
  return RevenueCatUI.presentPaywall({
    customVariables: {
      tokens_balance: CustomVariableValue.string(String(tokensBalance ?? 0)),
    },
  });
}