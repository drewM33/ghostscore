// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IReputationRegistryTier {
    function getTier(address agent) external view returns (uint8);
}

/// @title APIGatekeeper
/// @notice Manages API registrations, tier-gated access checks, and call recording.
contract APIGatekeeper {
    struct API {
        string name;
        uint8 requiredTier;
        uint256 pricePerCall;
        address provider;
        uint256 totalCalls;
        uint256 totalRevenue;
        bool active;
    }

    uint256 public nextApiId = 1;
    mapping(uint256 => API) public apis;
    mapping(address => uint256[]) public providerAPIs;
    mapping(address => bool) public authorizedMiddleware;

    address public reputationRegistry;
    address public admin;

    event APIRegistered(
        uint256 indexed apiId,
        string name,
        uint8 requiredTier,
        uint256 pricePerCall,
        address indexed provider
    );
    event APICallRecorded(
        uint256 indexed apiId,
        address indexed agent,
        uint256 payment
    );

    modifier onlyAuthorized() {
        require(authorizedMiddleware[msg.sender], "Not authorized");
        _;
    }

    /// @param _reputationRegistry Address of the deployed ReputationRegistry.
    constructor(address _reputationRegistry) {
        reputationRegistry = _reputationRegistry;
        admin = msg.sender;
    }

    /// @notice Authorize a middleware address to record API calls.
    /// @param middleware Address to authorize.
    function setMiddleware(address middleware, bool authorized) external {
        require(msg.sender == admin, "Only admin");
        authorizedMiddleware[middleware] = authorized;
    }

    /// @notice Register a new API endpoint.
    /// @param requiredTier Minimum reputation tier to access (0-3).
    /// @param pricePerCall Price per call in wei.
    /// @param name Human-readable API name.
    /// @return apiId The ID assigned to the new API.
    function registerAPI(
        uint8 requiredTier,
        uint256 pricePerCall,
        string calldata name
    ) external returns (uint256 apiId) {
        apiId = nextApiId++;
        apis[apiId] = API({
            name: name,
            requiredTier: requiredTier,
            pricePerCall: pricePerCall,
            provider: msg.sender,
            totalCalls: 0,
            totalRevenue: 0,
            active: true
        });
        providerAPIs[msg.sender].push(apiId);
        emit APIRegistered(apiId, name, requiredTier, pricePerCall, msg.sender);
    }

    /// @notice Check whether an agent meets the tier requirement for an API.
    /// @param agent Agent address to check.
    /// @param apiId API to check against.
    /// @return True if the agent's tier meets or exceeds the API's required tier.
    function checkAccess(address agent, uint256 apiId)
        external
        view
        returns (bool)
    {
        uint8 agentTier = IReputationRegistryTier(reputationRegistry).getTier(
            agent
        );
        return agentTier >= apis[apiId].requiredTier;
    }

    /// @notice Record an API call. Only callable by authorized middleware.
    /// @param agent Agent that made the call.
    /// @param apiId API that was called.
    /// @param payment Amount paid for the call.
    function recordCall(
        address agent,
        uint256 apiId,
        uint256 payment
    ) external onlyAuthorized {
        apis[apiId].totalCalls++;
        apis[apiId].totalRevenue += payment;
        emit APICallRecorded(apiId, agent, payment);
    }

    /// @notice Get full details of an API.
    /// @param apiId API identifier.
    /// @return name API name.
    /// @return requiredTier Minimum tier.
    /// @return pricePerCall Price per call.
    /// @return provider Provider address.
    /// @return totalCalls Total calls made.
    /// @return totalRevenue Total revenue earned.
    /// @return active Whether the API is active.
    function getAPI(uint256 apiId)
        external
        view
        returns (
            string memory name,
            uint8 requiredTier,
            uint256 pricePerCall,
            address provider,
            uint256 totalCalls,
            uint256 totalRevenue,
            bool active
        )
    {
        API storage a = apis[apiId];
        return (
            a.name,
            a.requiredTier,
            a.pricePerCall,
            a.provider,
            a.totalCalls,
            a.totalRevenue,
            a.active
        );
    }

    /// @notice Get all API IDs registered by a provider.
    /// @param provider Provider address.
    /// @return Array of API IDs.
    function getProviderAPIs(address provider)
        external
        view
        returns (uint256[] memory)
    {
        return providerAPIs[provider];
    }
}
