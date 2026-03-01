// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IReputationRegistryGov {
    function setOracle(address newOracle) external;
    function setPaused(bool _paused) external;
}

/// @title Governance
/// @notice Lightweight 2-of-3 multisig for oracle changes and emergency pauses.
contract Governance {
    address[3] public signers;
    address public reputationRegistry;
    uint256 public timelockSeconds;

    struct Proposal {
        address newOracle;
        uint256 createdAt;
        uint256 approvalCount;
        bool executed;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public proposalApprovals;
    uint256 public nextProposalId = 1;

    mapping(address => bool) public pauseVotes;
    uint256 public pauseVoteCount;

    event ProposalCreated(
        uint256 indexed proposalId,
        address newOracle,
        address indexed proposer
    );
    event ProposalApproved(
        uint256 indexed proposalId,
        address indexed approver
    );
    event ProposalExecuted(uint256 indexed proposalId, address newOracle);
    event EmergencyPauseTriggered();

    modifier onlySigner() {
        require(_isSigner(msg.sender), "Not a signer");
        _;
    }

    /// @param _reputationRegistry Address of the ReputationRegistry to govern.
    /// @param _signers Array of 3 signer addresses for the multisig.
    /// @param _timelockSeconds Seconds to wait after proposal creation before execution (60 for demo, 86400 for prod).
    constructor(
        address _reputationRegistry,
        address[3] memory _signers,
        uint256 _timelockSeconds
    ) {
        reputationRegistry = _reputationRegistry;
        signers = _signers;
        timelockSeconds = _timelockSeconds;
    }

    /// @notice Propose changing the oracle address on ReputationRegistry.
    /// @param newOracle Address of the proposed new oracle.
    /// @return proposalId ID of the created proposal.
    function proposeOracleChange(address newOracle)
        external
        onlySigner
        returns (uint256 proposalId)
    {
        proposalId = nextProposalId++;
        Proposal storage p = proposals[proposalId];
        p.newOracle = newOracle;
        p.createdAt = block.timestamp;
        emit ProposalCreated(proposalId, newOracle, msg.sender);
    }

    /// @notice Approve a pending proposal. Each signer can only approve once.
    /// @param proposalId ID of the proposal to approve.
    function approveProposal(uint256 proposalId) external onlySigner {
        Proposal storage p = proposals[proposalId];
        require(p.createdAt > 0, "Proposal does not exist");
        require(!p.executed, "Already executed");
        require(
            !proposalApprovals[proposalId][msg.sender],
            "Already approved"
        );

        proposalApprovals[proposalId][msg.sender] = true;
        p.approvalCount++;
        emit ProposalApproved(proposalId, msg.sender);
    }

    /// @notice Execute a proposal after timelock and 2-of-3 approval.
    /// @param proposalId ID of the proposal to execute.
    function executeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.createdAt > 0, "Proposal does not exist");
        require(!p.executed, "Already executed");
        require(p.approvalCount >= 2, "Need 2 approvals");
        require(
            block.timestamp >= p.createdAt + timelockSeconds,
            "Timelock active"
        );

        p.executed = true;
        IReputationRegistryGov(reputationRegistry).setOracle(p.newOracle);
        emit ProposalExecuted(proposalId, p.newOracle);
    }

    /// @notice Vote for an emergency pause. Triggers when 2 of 3 signers vote.
    function emergencyPause() external onlySigner {
        require(!pauseVotes[msg.sender], "Already voted");
        pauseVotes[msg.sender] = true;
        pauseVoteCount++;

        if (pauseVoteCount >= 2) {
            IReputationRegistryGov(reputationRegistry).setPaused(true);
            emit EmergencyPauseTriggered();
        }
    }

    function _isSigner(address addr) private view returns (bool) {
        return (addr == signers[0] ||
            addr == signers[1] ||
            addr == signers[2]);
    }
}
