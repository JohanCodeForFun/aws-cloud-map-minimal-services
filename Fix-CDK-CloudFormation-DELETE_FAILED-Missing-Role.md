# Fix: CDK / CloudFormation `DELETE_FAILED` + Missing Role

## Problem

You see errors like:

```
Role arn:aws:iam::<ACCOUNT>:role/cdk-hnb659fds-cfn-exec-role-... is invalid or cannot be assumed
```

And your stacks are stuck in:

- `DELETE_FAILED`
- `CDKToolkit` broken
- Resources already manually deleted

---

## Root Cause

- CDK bootstrap roles (like `cfn-exec-role`) are **missing or broken**
- CloudFormation is still trying to use that role
- Stack deletion fails **before it even starts**

---

## ✅ Solution Overview

1. Create a **temporary CloudFormation service role**
2. Use it to **force delete the stuck stacks**
3. Re-bootstrap CDK cleanly

---

# Step-by-Step Fix

---

## 1. Create Trust Policy

**(Included in /root of this repo)**

Create a file:

```json
// trust-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudformation.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

---

## 2. Create IAM Role

```bash
aws iam create-role \
  --role-name CloudFormationDeleteRole \
  --assume-role-policy-document file://trust-policy.json
```

---

## 3. Attach Permissions

```bash
aws iam attach-role-policy \
  --role-name CloudFormationDeleteRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

> ⚠️ This is temporary for cleanup

---

## 4. Force Delete Stuck Stack

```bash
aws cloudformation delete-stack \
  --stack-name CloudMapMinimalServicesStack \
  --region eu-north-1 \
  --role-arn arn:aws:iam::<ACCOUNT_ID>:role/CloudFormationDeleteRole \
  --deletion-mode FORCE_DELETE_STACK
```

---

## 5. Wait for Deletion

```bash
aws cloudformation wait stack-delete-complete \
  --stack-name CloudMapMinimalServicesStack \
  --region eu-north-1
```

---

## 6. Delete Broken CDKToolkit Stack

```bash
aws cloudformation delete-stack \
  --stack-name CDKToolkit \
  --region eu-north-1 \
  --role-arn arn:aws:iam::<ACCOUNT_ID>:role/CloudFormationDeleteRole \
  --deletion-mode FORCE_DELETE_STACK
```

This removes the `CDKToolkit` stack itself and any bootstrap resources that are still managed by that stack. You do not need a separate step to remove the old CDK bootstrap roles. If some of those roles were already manually deleted, that is fine.

---

## 7. Wait for `CDKToolkit` Deletion

```bash
aws cloudformation wait stack-delete-complete \
  --stack-name CDKToolkit \
  --region eu-north-1
```

---

## 8. Remove Temporary Cleanup Role

This role is not part of `CDKToolkit`, so delete it separately after cleanup and re-bootstrap are complete.

```bash
aws iam detach-role-policy \
  --role-name CloudFormationDeleteRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

aws iam delete-role \
  --role-name CloudFormationDeleteRole
```

---

# ⚡ Quick Checklist

- [ ] Region = `eu-north-1`
- [ ] Correct AWS account (`aws sts get-caller-identity`)
- [ ] Broken `CloudMapMinimalServicesStack` removed
- [ ] Broken `CDKToolkit` removed
- [ ] Temporary `CloudFormationDeleteRole` removed

---

# 💡 Key Takeaways

- CDK **requires bootstrap roles** per account + region
- If those roles are deleted → everything breaks
- CloudFormation keeps using old roles unless overridden
- `--role-arn` + `FORCE_DELETE_STACK` is the escape hatch
