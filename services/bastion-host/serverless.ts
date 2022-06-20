import type { AWS } from "@serverless/typescript";

import hello from "@functions/hello";

const serverlessConfiguration: AWS = {
  service: "bastion-host",
  frameworkVersion: "3",
  plugins: ["serverless-esbuild"],
  provider: {
    name: "aws",
    runtime: "nodejs14.x",
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
    vpc: "${file(../../serverless.yml):resources.Resources.Vpc}",
  },
  resources: {
    Resources: {
      PublicSubnet: {
        Type: "AWS::EC2::Subnet",
        Properties: {
          AvailabilityZone: "ap-northeast-2c",
          CidrBlock: "30.0.2.0/24",
          VpcId: {
            Ref: "${self:custom:vpc}",
          },
        },
      },
      BHSecurityGroup: {
        Type: "AWS::EC2::SecurityGroup",
        Properties: {
          GroupName: "${self:service}-${self:provider.stage}-db",
          GroupDescription: "Allow my inbound to port 22, no outbound",
          SecurityGroupIngress: [
            {
              CidrIp: "218.235.68.160",
              IpProtocol: "tcp",
              FromPort: 22,
              ToPort: 22,
            },
          ],
          VpcId: {
            Ref: "${self:custom:vpc}",
          },
        },
      },
      BastionHost: {
        Type: "AWS::EC2::Instance",
        Properties: {
          InstanceType: "t2.micro",
          ImageId: "ami-0fd0765afb77bcca7",
          SecurityGroups: [
            {
              Ref: "BHSecurityGroup",
            },
          ],
          SourceDestCheck: false,
          SubnetId: {
            Ref: "PublicSubnet",
          },
        },
      },
      AllowSSH: {
        Type: "AWS::EC2::SecurityGroupIngress",
        Properties: {
          SourceSecurityGroupId: {
            Ref: "BHSecurityGroup",
          },
          GroupId: {
            Ref: "${file(../../serverless.yml):resources.Resources.DBSecurityGroup}",
          },
          IpProtocol: "tcp",
          FromPort: 22,
          ToPort: 22,
        },
      },
    },
  },
};

module.exports = serverlessConfiguration;
