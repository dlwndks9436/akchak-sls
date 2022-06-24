import type { AWS } from "@serverless/typescript";

import hello from "@functions/hello";
import Region from "../../Types/Region";

const serverlessConfiguration: AWS = {
  service: "bastion-host",
  frameworkVersion: "3",
  plugins: ["serverless-esbuild", "serverless-offline"],
  provider: {
    name: "aws",
    runtime: "nodejs14.x",
    stage: "${opt:stage, 'dev'}",
    region: "${opt:region, 'ap-northeast-2'}" as Region,
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      NODE_OPTIONS: "--enable-source-maps --stack-trace-limit=1000",
    },
  },
  // import the function via paths
  functions: { hello },
  package: { individually: true },
  custom: {
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: true,
      exclude: ["aws-sdk"],
      target: "node14",
      define: { "require.resolve": undefined },
      platform: "node",
      concurrency: 10,
    },
    vpc: "${param:vpc}",
    dbSecurityGroup: "${param:db-security-group-id}",
  },
  resources: {
    Resources: {
      PublicSubnet: {
        Type: "AWS::EC2::Subnet",
        Properties: {
          AvailabilityZone: "ap-northeast-2c",
          CidrBlock: "30.0.2.0/24",
          VpcId: "${self:custom.vpc}",
        },
      },
      BHSecurityGroup: {
        Type: "AWS::EC2::SecurityGroup",
        Properties: {
          GroupName: "${self:service}-${self:provider.stage}-db",
          GroupDescription: "Allow my inbound to port 22, no outbound",
          SecurityGroupIngress: [
            {
              CidrIp: "218.235.68.0/24",
              IpProtocol: "tcp",
              FromPort: 22,
              ToPort: 22,
            },
          ],
          VpcId: "${self:custom.vpc}",
        },
      },
      InternetGateway: {
        Type: "AWS::EC2::InternetGateway",
      },
      VPCGatewayAttachment: {
        Type: "AWS::EC2::VPCGatewayAttachment",
        Properties: {
          VpcId: "${self:custom.vpc}",
          InternetGatewayId: {
            Ref: "InternetGateway",
          },
        },
      },
      PublicRouteTable: {
        Type: "AWS::EC2::RouteTable",
        Properties: {
          VpcId: "${self:custom.vpc}",
        },
      },
      PublicRoute: {
        Type: "AWS::EC2::Route",
        Properties: {
          RouteTableId: {
            Ref: "PublicRouteTable",
          },
          DestinationCidrBlock: "0.0.0.0/0",
          GatewayId: {
            Ref: "InternetGateway",
          },
        },
      },
      SubnetRouteTableAssociationPublic1: {
        Type: "AWS::EC2::SubnetRouteTableAssociation",
        Properties: {
          SubnetId: {
            Ref: "PublicSubnet",
          },
          RouteTableId: {
            Ref: "PublicRouteTable",
          },
        },
      },
      NewKeyPair: {
        Type: "AWS::EC2::KeyPair",
        Properties: {
          KeyName: "BHKeyPair",
        },
      },
      BastionHost: {
        Type: "AWS::EC2::Instance",
        Properties: {
          InstanceType: "t2.micro",
          ImageId: "ami-0fd0765afb77bcca7",
          KeyName: {
            Ref: "NewKeyPair",
          },
          NetworkInterfaces: [
            {
              AssociatePublicIpAddress: true,
              DeleteOnTermination: true,
              SubnetId: {
                Ref: "PublicSubnet",
              },
              DeviceIndex: 0,
              GroupSet: [{ "Fn::GetAtt": ["BHSecurityGroup", "GroupId"] }],
            },
          ],
          SourceDestCheck: false,
        },
      },
      AllowSSH: {
        Type: "AWS::EC2::SecurityGroupIngress",
        Properties: {
          SourceSecurityGroupId: {
            Ref: "BHSecurityGroup",
          },
          GroupId: "${self:custom.dbSecurityGroup}",
          IpProtocol: "tcp",
          FromPort: 22,
          ToPort: 22,
        },
      },
    },
    Outputs: {
      NewKeyPairId: {
        Value: { "Fn::GetAtt": ["NewKeyPair", "KeyPairId"] },
      },
    },
  },
};

module.exports = serverlessConfiguration;
