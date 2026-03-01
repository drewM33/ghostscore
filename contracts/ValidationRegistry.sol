// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ValidationRegistry
/// @notice Tracks validation records submitted by authorized API providers for agents.
contract ValidationRegistry {
    struct ValidationRecord {
        bytes32 actionHash;
        bool success;
        address provider;
        uint256 timestamp;
    }

    mapping(address => bool) public authorizedProviders;
    mapping(address => ValidationRecord[]) private _validations;

    address public admin;

    event ValidationSubmitted(
        address indexed agent,
        bytes32 actionHash,
        bool success,
        address indexed provider
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    /// @param _admin Address that can authorize providers.
    constructor(address _admin) {
        admin = _admin;
    }

    /// @notice Authorize a provider to submit validations.
    /// @param provider Address of the provider to authorize.
    function addProvider(address provider) external onlyAdmin {
        authorizedProviders[provider] = true;
    }

    /// @notice Submit a validation record for an agent. Only authorized providers.
    /// @param agent Agent address being validated.
    /// @param actionHash Hash identifying the action validated.
    /// @param success Whether the validation passed.
    function submitValidation(
        address agent,
        bytes32 actionHash,
        bool success
    ) external {
        require(authorizedProviders[msg.sender], "Not authorized provider");
        _validations[agent].push(
            ValidationRecord({
                actionHash: actionHash,
                success: success,
                provider: msg.sender,
                timestamp: block.timestamp
            })
        );
        emit ValidationSubmitted(agent, actionHash, success, msg.sender);
    }

    /// @notice Get total validation count for an agent.
    /// @param agent Address to query.
    /// @return Total number of validations.
    function getValidationCount(address agent) external view returns (uint256) {
        return _validations[agent].length;
    }

    /// @notice Get the success rate for an agent.
    /// @param agent Address to query.
    /// @return successes Number of successful validations.
    /// @return total Total number of validations.
    function getValidationRate(address agent)
        external
        view
        returns (uint256 successes, uint256 total)
    {
        ValidationRecord[] storage records = _validations[agent];
        total = records.length;
        for (uint256 i = 0; i < total; i++) {
            if (records[i].success) {
                successes++;
            }
        }
    }
}
