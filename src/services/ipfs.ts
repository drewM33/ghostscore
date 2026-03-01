export interface AgentMetadata {
  address: string;
  name: string;
  description: string;
  capabilities: string[];
  avatar?: string;
  pinnedAt: string;
}

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

function getPinataKeys(): { apiKey: string; secret: string } {
  const apiKey = process.env.PINATA_API_KEY;
  const secret = process.env.PINATA_SECRET;
  if (!apiKey || !secret) {
    throw new Error('PINATA_API_KEY and PINATA_SECRET must be set in .env');
  }
  return { apiKey, secret };
}

export async function pinMetadataToIPFS(metadata: AgentMetadata): Promise<{ cid: string; metadataURI: string }> {
  const { apiKey, secret } = getPinataKeys();

  const body = JSON.stringify({
    pinataContent: metadata,
    pinataMetadata: {
      name: `agent-${metadata.address}`,
    },
  });

  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: apiKey,
      pinata_secret_api_key: secret,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata pin failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as PinataResponse;
  return {
    cid: data.IpfsHash,
    metadataURI: `ipfs://${data.IpfsHash}`,
  };
}

export async function fetchMetadataFromIPFS(metadataURI: string): Promise<AgentMetadata> {
  const cid = metadataURI.replace(/^ipfs:\/\//, '');
  const gatewayURL = `https://gateway.pinata.cloud/ipfs/${cid}`;

  const res = await fetch(gatewayURL);
  if (!res.ok) {
    throw new Error(`IPFS fetch failed (${res.status}): ${gatewayURL}`);
  }

  return (await res.json()) as AgentMetadata;
}
