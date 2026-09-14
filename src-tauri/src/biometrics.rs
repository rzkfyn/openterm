use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiometricStatus {
    pub is_available: bool,
    pub is_enabled: bool,
}

pub fn check_biometric_available() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
        use windows::Security::Credentials::UI::{UserConsentVerifier, UserConsentVerifierAvailability};

        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }

        let avail_op = UserConsentVerifier::CheckAvailabilityAsync()
            .map_err(|e| format!("Failed to check biometric availability: {e}"))?;
        let result = avail_op
            .get()
            .map_err(|e| format!("Async availability failed: {e}"))?;
        Ok(result == UserConsentVerifierAvailability::Available)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

pub fn request_biometric_verification(message: &str) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::core::HSTRING;
        use windows::Foundation::IAsyncOperation;
        use windows::Security::Credentials::UI::{
            UserConsentVerificationResult, UserConsentVerifier,
        };
        use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
        use windows::Win32::System::WinRT::IUserConsentVerifierInterop;
        use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }

        let hwnd = unsafe { GetForegroundWindow() };
        let reason_hstring = HSTRING::from(message);

        // Win32 desktop apps require IUserConsentVerifierInterop to attach modal dialog to HWND
        let interop: Result<IUserConsentVerifierInterop, _> =
            windows::core::factory::<UserConsentVerifier, IUserConsentVerifierInterop>();

        let result = match interop {
            Ok(factory) if !hwnd.0.is_null() => {
                let operation: IAsyncOperation<UserConsentVerificationResult> = unsafe {
                    factory
                        .RequestVerificationForWindowAsync(hwnd, &reason_hstring)
                        .map_err(|e| format!("RequestVerificationForWindowAsync error: {e}"))?
                };
                operation
                    .get()
                    .map_err(|e| format!("Async verification .get() error: {e}"))?
            }
            _ => {
                let req_op = UserConsentVerifier::RequestVerificationAsync(&reason_hstring)
                    .map_err(|e| format!("Failed to request biometric verification: {e}"))?;
                req_op
                    .get()
                    .map_err(|e| format!("Async verification failed: {e}"))?
            }
        };

        Ok(result == UserConsentVerificationResult::Verified)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = message;
        Ok(false)
    }
}
