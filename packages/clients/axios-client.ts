import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

const axiosClient = (options: AxiosRequestConfig): Promise<AxiosResponse> =>
	axios.request(options)

export default axiosClient
