import RevenueCatUI, { CustomVariableValue, PAYWALL_RESULT } from "react-native-purchases-ui";

// Make sure to configure a Paywall in the Dashboard first.
export async function presentPaywall(tokensBalance: number | null): Promise<boolean> {
    
    // Present paywall for current offering:
    try {
        const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall({
        customVariables: {
            tokens_balance: CustomVariableValue.string(String(tokensBalance ?? 0)),
        },
        });

        switch (paywallResult) {
        case PAYWALL_RESULT.PURCHASED:
        case PAYWALL_RESULT.RESTORED:
            return true;
        case PAYWALL_RESULT.NOT_PRESENTED:
        case PAYWALL_RESULT.ERROR:
        case PAYWALL_RESULT.CANCELLED:
        default:
            return false;
        }
    } catch (error) {
        console.warn('Failed to present RevenueCat paywall', error);
        return false;
    }
}

