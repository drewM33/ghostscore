// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IReputationRegistry {
    function getTier(address agent) external view returns (uint8);
}

/// @title AgentIdentityRegistry
/// @notice Registry for AI agent identities with metadata and tier-based discovery.
contract AgentIdentityRegistry {
    struct Agent {
        bool registered;
        string metadataURI;
        uint256 registeredAt;
    }

    mapping(address => Agent) private _agents;
    address[] private _registeredAgents;

    event AgentRegistered(address indexed agent, uint256 timestamp);
    event MetadataUpdated(address indexed agent, string metadataURI);

    /// @notice Register a new agent. Reverts if already registered.
    /// @param agent Address of the agent to register.
    function registerAgent(address agent) external {
        require(!_agents[agent].registered, "Already registered");
        _agents[agent] = Agent({
            registered: true,
            metadataURI: "",
            registeredAt: block.timestamp
        });
        _registeredAgents.push(agent);
        emit AgentRegistered(agent, block.timestamp);
    }

    /// @notice Update the metadata URI for an agent. Only the agent itself may call this.
    /// @param agent Address of the agent whose metadata to update.
    /// @param metadataURI New metadata URI string.
    function updateMetadata(address agent, string calldata metadataURI) external {
        require(msg.sender == agent, "Only agent can update");
        require(_agents[agent].registered, "Not registered");
        _agents[agent].metadataURI = metadataURI;
        emit MetadataUpdated(agent, metadataURI);
    }

    /// @notice Get agent info.
    /// @param agent Address to query.
    /// @return registered Whether the agent is registered.
    /// @return metadataURI The agent's metadata URI.
    /// @return registeredAt Block timestamp of registration.
    function getAgent(address agent)
        external
        view
        returns (bool registered, string memory metadataURI, uint256 registeredAt)
    {
        Agent storage a = _agents[agent];
        return (a.registered, a.metadataURI, a.registeredAt);
    }

    /// @notice Discover agents that meet a minimum reputation tier.
    /// @param minTier Minimum tier threshold (0-3).
    /// @param reputationRegistry Address of the ReputationRegistry contract.
    /// @return result Array of agent addresses meeting the tier requirement (capped at 100).
    function discoverAgents(uint8 minTier, address reputationRegistry)
        external
        view
        returns (address[] memory)
    {
        IReputationRegistry rep = IReputationRegistry(reputationRegistry);
        uint256 len = _registeredAgents.length;
        uint256 cap = len > 100 ? 100 : len;

        address[] memory buf = new address[](cap);
        uint256 count = 0;

        for (uint256 i = 0; i < cap; i++) {
            address agent = _registeredAgents[i];
            if (rep.getTier(agent) >= minTier) {
                buf[count] = agent;
                count++;
            }
        }

        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = buf[i];
        }
        return result;
    }
}
