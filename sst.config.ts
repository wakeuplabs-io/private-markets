/// <reference path="./.sst/platform/config.d.ts" />

const PROJECT_NAME = "private-markets";
const AWS_REGION = "sa-east-1";

const GITHUB_CONFIG = {
  REPO: "wakeuplabs-io/private-markets",
  BRANCH: "develop",
};

// Relayer config (from env vars or defaults)
const RELAYER_ENV = {
  WORMHOLE_CONTRACT: "0x2b13cff4daef709134419f1506ccae28956e02102a5ef5f2d0077e4991a9f493",
  EMITTER_ADDRESS: "0x2b13cff4daef709134419f1506ccae28956e02102a5ef5f2d0077e4991a9f493",
  PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY || "",
  ARBITRUM_TARGET_CONTRACT: "0x01Bae5afDBCc24c4C903c7A323CE85A7A0791939",
};

export default $config({
  app(input) {
    return {
      name: PROJECT_NAME,
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: AWS_REGION,
          defaultTags: {
            tags: {
              project: PROJECT_NAME,
              environment: input.stage,
            },
          },
        },
        tls: true,
      },
    };
  },

  async run() {
    const stage = $app.stage;

    // ========== EC2 FOR RELAYER ==========

    // Generate SSH key pair
    const sshKey = new tls.PrivateKey(`${PROJECT_NAME}-ssh-key`, {
      algorithm: "RSA",
      rsaBits: 4096,
    });

    // Key Pair using generated public key
    const keyPair = new aws.ec2.KeyPair(`${PROJECT_NAME}-relayer-key`, {
      keyName: `${PROJECT_NAME}-relayer-${stage}`,
      publicKey: sshKey.publicKeyOpenssh,
      tags: { Name: `${PROJECT_NAME}-relayer-${stage}` },
    });

    // Security Group
    const sg = new aws.ec2.SecurityGroup(`${PROJECT_NAME}-relayer-sg`, {
      description: "Security group for relayer EC2",
      ingress: [
        { fromPort: 22, toPort: 22, protocol: "tcp", cidrBlocks: ["0.0.0.0/0"], description: "SSH" },
      ],
      egress: [
        { fromPort: 0, toPort: 0, protocol: "-1", cidrBlocks: ["0.0.0.0/0"] },
      ],
      tags: { Name: `${PROJECT_NAME}-relayer-sg-${stage}` },
    });

    // IAM Role for SSM
    const ec2Role = new aws.iam.Role(`${PROJECT_NAME}-ec2-role`, {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{ Action: "sts:AssumeRole", Effect: "Allow", Principal: { Service: "ec2.amazonaws.com" } }],
      }),
    });
    new aws.iam.RolePolicyAttachment(`${PROJECT_NAME}-ec2-ssm`, {
      role: ec2Role.name,
      policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
    });
    const instanceProfile = new aws.iam.InstanceProfile(`${PROJECT_NAME}-instance-profile`, {
      role: ec2Role.name,
    });

    // UserData script - values are interpolated at deploy time
    const userData = `#!/bin/bash
set -e
exec > >(tee /var/log/user-data.log) 2>&1

echo "Installing dependencies..."
yum update -y
yum install -y docker git golang

# Configure Go
export HOME=/root
export GOPATH=/root/go
export GOMODCACHE=/root/go/pkg/mod
mkdir -p $GOPATH $GOMODCACHE

echo "Starting Docker..."
systemctl start docker && systemctl enable docker

echo "Running Wormhole Spy..."
docker run -d --pull=always --restart=always --platform=linux/amd64 \\
  -p 7073:7073 --name wormhole-spy \\
  --entrypoint /guardiand ghcr.io/wormhole-foundation/guardiand:latest \\
  spy --nodeKey /node.key --spyRPC "[::]:7073" --env testnet

echo "Cloning repo..."
cd /opt
git clone -b ` + GITHUB_CONFIG.BRANCH + ` https://github.com/` + GITHUB_CONFIG.REPO + `.git
cd private-markets/packages/relayer

echo "Creating .env file..."
cat > .env << ENVEOF
# Wormhole contracts
WORMHOLE_CONTRACT=` + RELAYER_ENV.WORMHOLE_CONTRACT + `
EMITTER_ADDRESS=` + RELAYER_ENV.EMITTER_ADDRESS + `

# Arbitrum
PRIVATE_KEY=` + RELAYER_ENV.PRIVATE_KEY + `
ARBITRUM_TARGET_CONTRACT=` + RELAYER_ENV.ARBITRUM_TARGET_CONTRACT + `
ENVEOF

echo "Building relayer..."
go build -o relayer relayer.go

echo "Creating systemd service..."
cat > /etc/systemd/system/relayer.service << 'SERVICEEOF'
[Unit]
Description=Wormhole VAA Relayer
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=/opt/private-markets/packages/relayer
ExecStart=/opt/private-markets/packages/relayer/relayer
Restart=always
RestartSec=5
Environment=LOG_LEVEL=info

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable relayer
systemctl start relayer

echo "Done!"
`;

    // EC2 Instance
    const ami = aws.ec2.getAmiOutput({
      mostRecent: true,
      owners: ["amazon"],
      filters: [{ name: "name", values: ["al2023-ami-*-x86_64"] }],
    });

    const ec2 = new aws.ec2.Instance(`${PROJECT_NAME}-relayer`, {
      ami: ami.id,
      instanceType: "t3.small",
      keyName: keyPair.keyName,
      vpcSecurityGroupIds: [sg.id],
      iamInstanceProfile: instanceProfile.name,
      userData: userData,
      tags: { Name: `${PROJECT_NAME}-relayer-${stage}` },
    });

    return {
      relayer: {
        instanceId: ec2.id,
        publicIp: ec2.publicIp,
        ssh: $interpolate`ssh -i ~/.ssh/${keyPair.keyName}.pem ec2-user@${ec2.publicIp}`,
        keyPairName: keyPair.keyName,
        privateKey: sshKey.privateKeyPem,
      },
    };
  },
});
