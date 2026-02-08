declare interface BamzClient {
    /**
     * Fetches data from a given URL with optional options.
     * @param url The URL to fetch data from.
     * @param options Optional fetch options.
     * @returns The response from the fetch request.
     */
    fetch(url: string, options?: RequestInit): Promise<Response>;

    /**
     * Sends a JSON request to the specified URL.
     * @param url The URL to send the request to.
     * @param body The request body.
     * @param options Optional fetch options.
     * @returns The parsed JSON response.
     */
    json(url: string, body?: object, options?: RequestInit): Promise<any>;

    /**
     * Sends a GET request to the specified URL.
     * @param options The URL or options object.
     * @param queryParam Optional query parameters.
     * @returns The parsed JSON response.
     */
    get(options: string | { url: string; query?: object }, queryParam?: object): Promise<any>;

    /**
     * Sends a DELETE request to the specified URL.
     * @param options The URL or options object.
     * @param queryParam Optional query parameters.
     * @returns The parsed JSON response.
     */
    delete(options: string | { url: string; query?: object }, queryParam?: object): Promise<any>;

    /**
     * Sends a form/multipart POST request to the specified URL.
     * @param options The URL or options object.
     * @param bodyParam Optional request body.
     * @returns The parsed JSON response.
     */
    multipartPost(options: string | { url: string; body?: object }, bodyParam?: object): Promise<any>;

    /**
     * Sends a POST request to the specified URL.
     * @param options The URL or options object.
     * @param bodyParam Optional request body.
     * @returns The parsed JSON response.
     */
    post(options: string | { url: string; body?: object }, bodyParam?: object): Promise<any>;

    /**
     * Sends a PUT request to the specified URL.
     * @param options The URL or options object.
     * @param bodyParam Optional request body.
     * @returns The parsed JSON response.
     */
    put(options: string | { url: string; body?: object }, bodyParam?: object): Promise<any>;

    /**
     * Sends a PATCH request to the specified URL.
     * @param options The URL or options object.
     * @param bodyParam Optional request body.
     * @returns The parsed JSON response.
     */
    patch(options: string | { url: string; body?: object }, bodyParam?: object): Promise<any>;
}