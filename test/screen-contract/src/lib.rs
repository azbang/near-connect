use near_sdk::near;

#[near(contract_state)]
#[derive(Default)]
pub struct ScreenTestContract;

#[near]
impl ScreenTestContract {
    pub fn get(&self) -> String {
        "screen-test".to_string()
    }
}
