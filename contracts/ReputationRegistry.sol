// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ReputationRegistry
/// @notice Tracks agent reputation scores derived from ZK-shielded payment feedback.
contract ReputationRegistry {
    struct ReputationRecord {
        uint256 score;
        uint8 tier;
        uint256 totalPayments;
        uint256 totalVolume;
        uint256 uniqueAPIs;
        uint256 lastPaymentTimestamp;
        uint256 firstPaymentTimestamp;
    }

    mapping(address => ReputationRecord) private _records;
    mapping(bytes32 => bool) public usedNullifiers;
    mapping(address => bytes32[]) private _feedbackHistory;
    mapping(address => mapping(uint8 => bool)) private _seenAPIs;

    address public oracle;
    address public admin;
    bool public paused;

    event FeedbackSubmitted(
        address indexed agent,
        bytes32 nullifierHash,
        uint256 newScore,
        uint8 newTier
    );
    event TierChanged(address indexed agent, uint8 oldTier, uint8 newTier);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event Paused(bool paused);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    /// @param _admin Address that can set oracle and pause the contract.
    constructor(address _admin) {
        admin = _admin;
    }

    /// @notice Submit payment feedback for an agent. Only callable by the oracle.
    /// @param agent Address of the agent receiving feedback.
    /// @param nullifierHash ZK nullifier to prevent double-counting.
    /// @param paymentWeight Payment amount in wei to add to volume.
    /// @param apiId Identifier of the API used (0-255).
    function submitFeedback(
        address agent,
        bytes32 nullifierHash,
        uint256 paymentWeight,
        uint8 apiId
    ) external {
        require(!paused, "Paused");
        require(msg.sender == oracle, "Only oracle");
        require(!usedNullifiers[nullifierHash], "Nullifier used");

        usedNullifiers[nullifierHash] = true;
        _feedbackHistory[agent].push(nullifierHash);

        ReputationRecord storage r = _records[agent];

        if (r.firstPaymentTimestamp == 0) {
            r.firstPaymentTimestamp = block.timestamp;
        }

        r.totalPayments++;
        r.totalVolume += paymentWeight;
        r.lastPaymentTimestamp = block.timestamp;

        if (!_seenAPIs[agent][apiId]) {
            _seenAPIs[agent][apiId] = true;
            r.uniqueAPIs++;
        }

        uint256 volumeScore = _min(100, (r.totalVolume * 100) / 1 ether);
        uint256 frequencyScore = _min(100, r.totalPayments * 10);
        uint256 diversityScore = _min(100, r.uniqueAPIs * 33);
        uint256 recencyBonus = (block.timestamp - r.lastPaymentTimestamp < 1 hours)
            ? 100
            : 50;
        uint256 uniquenessRatio = _min(
            100,
            (r.totalPayments * 100) / _max(1, r.totalPayments)
        );

        r.score =
            (volumeScore * 35 +
                frequencyScore * 25 +
                diversityScore * 20 +
                recencyBonus * 10 +
                uniquenessRatio * 10) /
            100;

        uint8 oldTier = r.tier;
        if (r.score >= 80) {
            r.tier = 3;
        } else if (r.score >= 50) {
            r.tier = 2;
        } else if (r.score >= 20) {
            r.tier = 1;
        } else {
            r.tier = 0;
        }

        emit FeedbackSubmitted(agent, nullifierHash, r.score, r.tier);

        if (r.tier != oldTier) {
            emit TierChanged(agent, oldTier, r.tier);
        }
    }

    /// @notice Get the full score breakdown for an agent.
    /// @param agent Address to query.
    function getScore(address agent)
        external
        view
        returns (
            uint256 score,
            uint8 tier,
            uint256 totalPayments,
            uint256 lastPaymentTimestamp
        )
    {
        ReputationRecord storage r = _records[agent];
        return (r.score, r.tier, r.totalPayments, r.lastPaymentTimestamp);
    }

    /// @notice Get the current tier for an agent.
    /// @param agent Address to query.
    /// @return The agent's tier (0-3).
    function getTier(address agent) external view returns (uint8) {
        return _records[agent].tier;
    }

    /// @notice Get all nullifier hashes submitted as feedback for an agent.
    /// @param agent Address to query.
    /// @return Array of nullifier hashes.
    function getFeedbackHistory(address agent)
        external
        view
        returns (bytes32[] memory)
    {
        return _feedbackHistory[agent];
    }

    /// @notice Update the oracle address. Only callable by admin.
    /// @param newOracle New oracle address.
    function setOracle(address newOracle) external onlyAdmin {
        address old = oracle;
        oracle = newOracle;
        emit OracleUpdated(old, newOracle);
    }

    /// @notice Toggle the pause state. Only callable by admin.
    /// @param _paused Whether to pause or unpause.
    function setPaused(bool _paused) external onlyAdmin {
        paused = _paused;
        emit Paused(_paused);
    }

    /// @notice Transfer admin role. Only callable by current admin.
    /// @param newAdmin New admin address.
    function transferAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    function _max(uint256 a, uint256 b) private pure returns (uint256) {
        return a > b ? a : b;
    }
}
