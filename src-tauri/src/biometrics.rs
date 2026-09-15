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
    #[cfg(target_os = "macos")]
    {
        use objc2_local_authentication::{LAContext, LAPolicy};

        let context = unsafe { LAContext::new() };
        // Check if biometric authentication (Touch ID) is available and enrolled.
        // Fall back to checking device owner authentication (passcode/watch) if configured.
        let is_biometric_ok = unsafe {
            context.canEvaluatePolicy_error(LAPolicy::DeviceOwnerAuthenticationWithBiometrics).is_ok()
        };
        let is_device_owner_ok = unsafe {
            context.canEvaluatePolicy_error(LAPolicy::DeviceOwnerAuthentication).is_ok()
        };

        Ok(is_biometric_ok || is_device_owner_ok)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
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
    #[cfg(target_os = "macos")]
    {
        use block2::RcBlock;
        use objc2::runtime::Bool;
        use objc2_foundation::{NSError, NSString};
        use objc2_local_authentication::{LAContext, LAPolicy};
        use std::sync::mpsc::channel;

        let context = unsafe { LAContext::new() };
        let reason = NSString::from_str(message);

        // Prefer DeviceOwnerAuthentication so Touch ID is presented with password fallback
        let policy = LAPolicy::DeviceOwnerAuthentication;

        let (tx, rx) = channel::<bool>();
        let block = RcBlock::new(move |success: Bool, _error: *mut NSError| {
            let _ = tx.send(success.as_bool());
        });

        unsafe {
            context.evaluatePolicy_localizedReason_reply(policy, &reason, &block);
        }

        match rx.recv() {
            Ok(success) => Ok(success),
            Err(e) => Err(format!("Failed to receive biometric result: {e}")),
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = message;
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_biometric_available_does_not_panic() {
        let result = check_biometric_available();
        assert!(result.is_ok());
        println!("Biometric available on this device: {:?}", result);
    }
}

