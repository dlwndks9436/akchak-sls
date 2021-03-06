import type { AWS } from "@serverless/typescript";

import hello from "@functions/hello";
import Region from "./Types/Region";

const serverlessConfiguration: AWS = {
  service: "akchak-sls",
  frameworkVersion: "3",
  plugins: ["serverless-esbuild"],
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
      DATABASE_USERNAME: "admin",
      DATABASE_PASSWORD: "testing123",
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
  },
  resources: {
    Resources: {
      Vpc: {
        Type: "AWS::EC2::VPC",
        Properties: {
          CidrBlock: "30.0.0.0/16",
        },
      },
      PrivateSubnet1: {
        Type: "AWS::EC2::Subnet",
        Properties: {
          AvailabilityZone: "ap-northeast-2a",
          CidrBlock: "30.0.0.0/24",
          VpcId: {
            Ref: "Vpc",
          },
        },
      },
      PrivateSubnet2: {
        Type: "AWS::EC2::Subnet",
        Properties: {
          AvailabilityZone: "ap-northeast-2b",
          CidrBlock: "30.0.1.0/24",
          VpcId: {
            Ref: "Vpc",
          },
        },
      },
      DBSecurityGroup: {
        Type: "AWS::EC2::SecurityGroup",
        Properties: {
          GroupName: "${self:service}-${self:provider.stage}-db",
          GroupDescription: "Allow local inbound to port 3306, no outbound",
          SecurityGroupIngress: [
            {
              CidrIp: "30.0.0.0/16",
              IpProtocol: "tcp",
              FromPort: 3306,
              ToPort: 3306,
            },
          ],
          SecurityGroupEgress: [
            {
              IpProtocol: "-1",
              CidrIp: "127.0.0.1/32",
            },
          ],
          VpcId: {
            Ref: "Vpc",
          },
        },
      },
      DBSubnetGroup: {
        Type: "AWS::RDS::DBSubnetGroup",
        Properties: {
          DBSubnetGroupName: "${self:service}-${self:provider.stage}",
          DBSubnetGroupDescription: "Private database subnet group",
          SubnetIds: [{ Ref: "PrivateSubnet1" }, { Ref: "PrivateSubnet2" }],
        },
      },
      DBParameterGroup: {
        Type: "AWS::RDS::DBParameterGroup",
        Properties: {
          Description: "Parameter group for akchak db",
          Family: "mysql5.7",
          Parameters: {
            character_set_client: "utf8mb4",
            character_set_connection: "utf8mb4",
            character_set_database: "utf8mb4",
            character_set_filesystem: "utf8mb4",
            character_set_results: "utf8mb4",
            character_set_server: "utf8mb4",
            collation_connection: "utf8mb4_unicode_ci",
            collation_server: "utf8mb4_unicode_ci",
          },
        },
      },
      Database: {
        Type: "AWS::RDS::DBInstance",
        Properties: {
          DBInstanceIdentifier: "${self:service}-${self:provider.stage}",
          Engine: "mysql",
          DBName: "akchakdb",
          AllocatedStorage: "5",
          EngineVersion: "5.7.38",
          DBInstanceClass: "db.t2.micro",
          MasterUsername: "${self:provider.environment.DATABASE_USERNAME}",
          MasterUserPassword: "${self:provider.environment.DATABASE_PASSWORD}",
          DBParameterGroupName: {
            Ref: "DBParameterGroup",
          },
          DBSubnetGroupName: {
            Ref: "DBSubnetGroup",
          },
          VPCSecurityGroups: [
            {
              Ref: "DBSecurityGroup",
            },
          ],
        },
      },
    },
  },
};

module.exports = serverlessConfiguration;
