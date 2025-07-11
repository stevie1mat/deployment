# Shared Models for the Trademinutes Application

This repository contains shared data models used across components of the Trademinutes application.

## Usage in Go API Backend

To include this package in your Go API backend:

1. Add the following to your `go.mod` file:

    ```go
    require (
         github.com/ElioCloud/shared-models v0.1.6
    )
    ```
    > **Note:** Replace `v0.1.6` with the [latest available version](https://github.com/ElioCloud/shared-models/tags).

2. Download the dependency and clean up module files:

    ```bash
    go mod tidy
    ```

3. Run your application:

    ```bash
    go run main.go
    ```
