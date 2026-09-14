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
        use windows::Security::Credentials::UI::{UserConsentVerifier, UserConsentVerifierAvailability};
        let avail_op = UserConsentVerifier::CheckAvailabilityAsync()
            .map_err(|e| format!("Failed to check biometric availability: {e}"))?;
        let result = avail_op.get()
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
        use windows::Security::Credentials::UI::{UserConsentVerificationResult, UserConsentVerifier};
        let h_msg = HSTRING::from(message);
        let req_op = UserConsentVerifier::RequestVerificationAsync(&h_msg)
            .map_err(|e| format!("Failed to request biometric verification: {e}"))?;
        let result = req_op.get()
            .map_err(|e| format!("Async verification failed: {e}"))?;
        Ok(result == UserConsentVerificationResult::Verified)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = message;
        Ok(false)
    }
}
