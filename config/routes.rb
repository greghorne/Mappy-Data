Rails.application.routes.draw do
  root 'map#index'
  post  'check_region' => 'map#check_region'
  post 'create_isochrone' => 'map#create_isochrone'

  # For details on the DSL available within this file, see http://guides.rubyonrails.org/routing.html
end
